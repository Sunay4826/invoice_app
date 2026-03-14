const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const prisma = require("../prisma");

const signToken = (user) => {
  const secret = process.env.JWT_SECRET || "dev_secret_change_me";
  return jwt.sign(
    { id: user.id, email: user.email, username: user.username },
    secret,
    { expiresIn: "7d" }
  );
};

const signup = async (req, res) => {
  try {
    const { email, username, password } = req.body || {};
    if (!email || !username || !password) {
      return res.status(400).json({ success: false, message: "Email, username, password are required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: { email: email.toLowerCase(), username, passwordHash },
      select: { id: true, email: true, username: true },
    });

    const token = signToken(user);
    res.status(201).json({ success: true, token, user });
  } catch (err) {
    if (err.code === "P2002") {
      return res.status(400).json({ success: false, message: "Email or username already exists" });
    }
    res.status(500).json({ success: false, message: err.message });
  }
};

const login = async (req, res) => {
  try {
    const { identifier, password } = req.body || {};
    if (!identifier || !password) {
      return res.status(400).json({ success: false, message: "Email/username and password are required" });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { email: identifier.toLowerCase() },
          { username: identifier },
        ],
      },
    });
    if (!user) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) return res.status(401).json({ success: false, message: "Invalid credentials" });

    const token = signToken(user);
    res.json({ success: true, token, user: { id: user.id, email: user.email, username: user.username } });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
};

const me = async (req, res) => {
  res.json({ success: true, user: req.user });
};

module.exports = { signup, login, me };
