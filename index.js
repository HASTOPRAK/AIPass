import dotenv from 'dotenv';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import bcrypt from 'bcrypt';
import { TOOLS } from "./config/tools.js";
import { chargeCreditsAndLog, getUsageForUser } from "./db/usage.js";
import { runGeminiTool } from "./services/gemini.js";
import passport from "passport";
import { setupPassport } from "./auth/passport.js";
import { getOrgByOwnerId, 
    createOrgForOwner, 
    listEmployeesByOrgId,
    listOrganizations,
    assignUserToOrg,
    removeUserFromOrg,
    assignUserToOwnersOrgByEmail
} from "./db/orgs.js";
import { getAdminStats, getRecentUsage, listUsers } from "./db/admin.js";
import { pool } from './db/pool.js';
import { createUser, findUserByEmail, findUserById } from './db/users.js';
import { PRICING, PRICING_LOOKUP } from './config/pricing.js';
import { addCreditsAndLogPurchase } from './db/billing.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

const PgSession = connectPgSimple(session);

setupPassport();



app.use(session({
  store: new PgSession({
    pool: pool,
    tableName: 'session'
  }),
  secret: process.env.SESSION_SECRET || "change-me",
  resave: false,
  saveUninitialized: false,
  cookie: { 
    httpOnly: true,
    sameSite: 'lax',
    secure: false,
    maxAge: 7 * 24 * 60 * 60 * 1000
   } // 7 days
}));


app.use(async (req, res, next) => {
    res.locals.appName = "AI Pass";
    res.locals.user = null;
    res.locals.profilePath = "/me";
    res.locals.navActive = req.path;


     if (req.session.userId) {
     try {
         res.locals.user = await findUserById(req.session.userId);
         res.locals.profilePath = roleHomePath(res.locals.user?.role);
        } catch (e) {
          // ignore
        }
    }
    next();
});

app.use(passport.initialize());
app.use(passport.session());


function roleHomePath(role) {
  if (role === "ADMIN") return "/admin";
  if (role === "OWNER") return "/owner";
  return "/me";
}


function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.redirect('/login');
  }
  next();
}

function requireAuthWithNext(req, res, next) {
  if (!req.session.userId) {
    const nextUrl = encodeURIComponent(req.originalUrl || "/app");
    return res.redirect(`/login?next=${nextUrl}`);
  }
  next();
}


function requireRole(role) {
  return (req, res, next) => {
    const user = res.locals.user;
    if (!user) return res.redirect("/login");
    if (user.role !== role) return res.status(403).send("Forbidden");
    next();
  };
}

function requireGuest(req, res, next) {
  if (req.session.userId) return res.redirect("/app");
  next();
}


function safeNext(nextPath) {
  if (!nextPath) return "/app";
  // allow only internal paths
  if (typeof nextPath !== "string") return "/app";
  if (!nextPath.startsWith("/")) return "/app";
  if (nextPath.startsWith("//")) return "/app";
  return nextPath;
}



app.get("/", (req, res) => res.render("index", { error: null }));
app.get("/login", requireGuest, (req, res) => res.render("login", { error: null, next: req.query.next || "/app" }));
app.get("/register", requireGuest, (req, res) => res.render("register", { error: null, next: req.query.next || "/app" }));
app.get("/tools/:toolKey", requireAuth, (req, res) => {
  const tool = TOOLS[req.params.toolKey];
  if (!tool) return res.status(404).send("Tool not found");

  res.render("tool", { tool, result: null, error: null, user: res.locals.user, input: "" });
});
app.get("/pricing", requireAuthWithNext, (req, res) => {
  const success = req.query.success;
  const pkgKey = req.query.pkg;

  let message = null;
  let error = null;

  if (success === "1" && pkgKey && PRICING_LOOKUP[pkgKey]) {
    const p = PRICING_LOOKUP[pkgKey];
    message = `Payment successful. Added ${p.credits} credits (${p.name}).`;
  } else if (success === "0") {
    error = "Payment failed. Please try again.";
  }

  res.render("pricing", { packages: PRICING, message, error });
});
app.get("/checkout/:packageKey", requireAuthWithNext, (req, res) => {
  const pkg = PRICING_LOOKUP[req.params.packageKey];
  if (!pkg) return res.status(404).send("Package not found");
  const role = res.locals.user?.role;
  if (pkg.key.startsWith("biz_") && !["OWNER", "ADMIN"].includes(role)) {
    return res.status(403).send("Business plans are for owners/admins.");
  }

  res.render("checkout", { pkg });
});
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { failureRedirect: "/login" }),
  (req, res) => {
    req.session.userId = req.user.id;
    res.redirect("/app");
  }
);


app.get("/app", requireAuth, async (req, res) => {
  const usage = await getUsageForUser(req.session.userId, 10);
  res.render("app", { tools: Object.values(TOOLS), usage, error: null });
});


app.get("/me", requireAuth, requireRole("INDIVIDUAL"), async (req, res) => {
  const usage = await getUsageForUser(req.session.userId, 30);
  res.render("dash_individual", { usage });
});

app.get("/owner", requireAuth, requireRole("OWNER"), async (req, res) => {
  const ownerId = req.session.userId;
  const transfer = req.query.transfer;
    let message = null;
    let error = null;
    if (transfer === "1") message = "Transfer successful.";
    if (transfer === "0") error = "Transfer failed.";
  let org = await getOrgByOwnerId(ownerId);
  if (!org) {
    org = await createOrgForOwner({ ownerUserId: ownerId, name: "My Company" });
  }

  const employees = await listEmployeesByOrgId(org.id);
  res.render("dash_owner", { org, employees, message: null, error: null });
});

app.get("/admin", requireAuth, requireRole("ADMIN"), async (req, res) => {
  const [stats, recentUsage, users, orgs] = await Promise.all([
    getAdminStats(),
    getRecentUsage(20),
    listUsers(50),
    listOrganizations(50),
  ]);

  res.render("dash_admin", { stats, recentUsage, users, orgs, message: null, error: null });
});






app.post("/register", requireGuest, async (req, res) => {
    try {
        const name = (req.body.name || "").trim();
        const email = (req.body.email || "").toLowerCase();
        const password = req.body.password || "";
        const role = req.body.role;
        const nextUrl = safeNext(req.body.next);
        
        if (!name || !email || !password) {
            return res.status(400).render("register", { error: "All fields are required." });
        }
        if (!["INDIVIDUAL", "OWNER"].includes(role)) {
            return res.status(400).render("register", { error: "Invalid account type selected." });
        }
        if (password.length < 8) {
            return res.status(400).render("register", { error: "Password must be at least 8 characters long." });
        }

        const existing = await findUserByEmail(email);
        if (existing) {
            return res.status(400).render("register", { error: "Email is already registered." });
        }

        const passwordHash = await bcrypt.hash(password, 12);
        const user = await createUser({ name, email, passwordHash, role });

        req.session.userId = user.id;
        res.redirect(nextUrl);
    } catch (err) {
        console.error("Registration error:", err);
        res.status(500).render("register", { error: "An error occurred. Please try again." });
    }
});

app.post("/login", requireGuest, async (req, res) => {
    try {
        const email = (req.body.email || "").trim().toLowerCase();
        const password = req.body.password || "";
        const nextUrl = safeNext(req.body.next);

        const user = await findUserByEmail(email);
        if (!user || !user.password_hash) {
            return res.status(401).render("login", { error: "Invalid email or password." });
        }

        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) {
            return res.status(401).render("login", { error: "Invalid email or password." });
        }

        req.session.userId = user.id;
        res.redirect(nextUrl);
    } catch (err) {
        console.error("Login error:", err);
        res.status(500).render("login", { error: "An error occurred. Please try again." });
    }
});


app.post("/logout", (req, res) => {
  req.session.destroy(() => {
    res.redirect("/");
  });
});

app.post("/tools/:toolKey/run", requireAuth, async (req, res) => {
    const tool = TOOLS[req.params.toolKey];
    if (!tool) return res.status(404).send("Tool not found");

    const input = (req.body.input || "").toString().trim();
    const inputChars = input.length;

    if (!input.trim()) {
        return res.status(400).render("tool", { tool, result: null, error: "Please enter some text.", user: res.locals.user, input });
    }

    try {
        const result = await runGeminiTool({
    toolKey: tool.key,
    input,
    });


    // Charge + log atomically
    await chargeCreditsAndLog({
      userId: req.session.userId,
      toolKey: tool.key,
      creditsCharged: tool.cost,
      inputChars,
      outputChars: result.length,
      status: "SUCCESS",
    });

    // Refresh user in locals
    res.locals.user = await findUserById(req.session.userId);

    return res.render("tool", { tool, result, error: null , user: res.locals.user, input });
  } catch (err) {
    if (err.code === "INSUFFICIENT_CREDITS") {
      return res.status(402).render("tool", {
        tool,
        result: null,
        error: `Not enough credits. You have ${err.available}. This tool costs ${tool.cost}.`,
        user: res.locals.user,
        input,
      });
    }

    console.error(err);
    // Log FAILED without charging
    try {
      await chargeCreditsAndLog({
        userId: req.session.userId,
        toolKey: tool.key,
        creditsCharged: tool.cost,
        inputChars,
        outputChars: 0,
        status: "FAILED",
        errorMessage: err.message?.slice(0, 200) || "Unknown error",
      });
    } catch (logErr) {
      console.error("Failed to log usage error:", logErr);
    }

    return res.status(500).render("tool", { tool, result: null, error: "Tool failed. Try again.", user: res.locals.user });
  }
});

app.post("/owner/transfer", requireAuthWithNext, requireRole("OWNER"), async (req, res) => {
  const ownerId = req.session.userId;
  const employeeId = req.body.employeeId;
  const amount = Number(req.body.amount);

  if (!employeeId || !Number.isFinite(amount) || amount <= 0) {
    return res.status(400).send("Invalid transfer.");
  }

  const org = await getOrgByOwnerId(ownerId);
  if (!org) return res.status(400).send("Organization missing.");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // lock owner
    const { rows: ownerRows } = await client.query(
      `SELECT id, credits FROM users WHERE id=$1 FOR UPDATE`,
      [ownerId]
    );
    const owner = ownerRows[0];
    if (!owner) throw new Error("Owner not found");

    // lock employee (must be in same org)
    const { rows: empRows } = await client.query(
      `SELECT id, credits FROM users WHERE id=$1 AND org_id=$2 FOR UPDATE`,
      [employeeId, org.id]
    );
    const emp = empRows[0];
    if (!emp) throw new Error("Employee not found in your org");

    if (owner.credits < amount) {
      throw new Error("INSUFFICIENT_OWNER_CREDITS");
    }

    await client.query(`UPDATE users SET credits = credits - $1 WHERE id = $2`, [amount, ownerId]);
    await client.query(`UPDATE users SET credits = credits + $1 WHERE id = $2`, [amount, employeeId]);

    await client.query("COMMIT");
  } catch (e) {
    await client.query("ROLLBACK");
    console.error(e);
    return res.redirect("/owner?transfer=0");
  } finally {
    client.release();
  }

  return res.redirect("/owner?transfer=1");
});


app.post("/owner/add-by-email", requireAuth, requireRole("OWNER"), async (req, res) => {
  const ownerId = req.session.userId;
  const email = (req.body.email || "").trim();

  try {
    if (!email) throw new Error("Email required");

    await assignUserToOwnersOrgByEmail({ ownerUserId: ownerId, email });

    // Re-render owner dashboard
    let org = await getOrgByOwnerId(ownerId);
    const employees = await listEmployeesByOrgId(org.id);

    return res.render("dash_owner", {
      org,
      employees,
      message: `Added ${email} to your company.`,
      error: null,
    });
  } catch (err) {
    console.error(err);

    let org = await getOrgByOwnerId(ownerId);
    const employees = org ? await listEmployeesByOrgId(org.id) : [];

    let msg = "Failed to add user.";
    if (err.code === "USER_NOT_FOUND") msg = "No user found with that email.";
    if (err.code === "INVALID_ROLE") msg = "That user is not an INDIVIDUAL account.";
    if (err.code === "ORG_NOT_FOUND") msg = "Your organization is missing (should auto-create).";

    return res.status(400).render("dash_owner", {
      org,
      employees,
      message: null,
      error: msg,
    });
  }
});


app.post("/admin/assign", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const userId = req.body.userId;
    const orgId = req.body.orgId;

    if (!userId || !orgId) throw new Error("Missing userId/orgId");

    await assignUserToOrg({ userId, orgId });

    const [stats, recentUsage, users, orgs] = await Promise.all([
      getAdminStats(),
      getRecentUsage(20),
      listUsers(50),
      listOrganizations(50),
    ]);

    return res.render("dash_admin", { stats, recentUsage, users, orgs, message: "User assigned to company.", error: null });
  } catch (err) {
    console.error(err);

    const [stats, recentUsage, users, orgs] = await Promise.all([
      getAdminStats(),
      getRecentUsage(20),
      listUsers(50),
      listOrganizations(50),
    ]);

    return res.status(400).render("dash_admin", {
      stats, recentUsage, users, orgs,
      message: null,
      error: "Failed to assign user. Check inputs.",
    });
  }
});

app.post("/admin/unassign", requireAuth, requireRole("ADMIN"), async (req, res) => {
  try {
    const userId = req.body.userId;
    if (!userId) throw new Error("Missing userId");

    await removeUserFromOrg({ userId });

    const [stats, recentUsage, users, orgs] = await Promise.all([
      getAdminStats(),
      getRecentUsage(20),
      listUsers(50),
      listOrganizations(50),
    ]);

    return res.render("dash_admin", { stats, recentUsage, users, orgs, message: "User removed from company.", error: null });
  } catch (err) {
    console.error(err);

    const [stats, recentUsage, users, orgs] = await Promise.all([
      getAdminStats(),
      getRecentUsage(20),
      listUsers(50),
      listOrganizations(50),
    ]);

    return res.status(400).render("dash_admin", {
      stats, recentUsage, users, orgs,
      message: null,
      error: "Failed to remove user from company.",
    });
  }
});

app.post("/checkout/:packageKey/complete", requireAuthWithNext, async (req, res) => {
  const pkg = PRICING_LOOKUP[req.params.packageKey];
  if (!pkg) return res.status(404).send("Package not found");

  const role = res.locals.user?.role;
  if (pkg.key.startsWith("biz_") && !["OWNER", "ADMIN"].includes(role)) {
    return res.status(403).send("Business plans are for owners/admins.");
  }

  try {
    await addCreditsAndLogPurchase({
      userId: req.session.userId,
      packageKey: pkg.key,
      creditsAdded: pkg.credits,
    });

    // Refresh locals for header credits
    res.locals.user = await findUserById(req.session.userId);

    return res.redirect(`/pricing?success=1&pkg=${encodeURIComponent(pkg.key)}`);
  } catch (e) {
    console.error(e);
    return res.redirect(`/pricing?success=0`);
  }
});



app.get("/health", (req, res) => res.json({ ok: true }));


app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});