import "dotenv/config";
import bcrypt from "bcryptjs";
import { emitKeypressEvents } from "node:readline";
import { stdin, stdout } from "node:process";
import { pool } from "../config/db.js";

const SUPER_ADMIN_EMAIL = "Mashaisharon5@gmail.com";

function askHiddenPassword(prompt: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!stdin.isTTY || typeof stdin.setRawMode !== "function") {
      reject(new Error("Please run this script in an interactive terminal."));
      return;
    }

    stdout.write(prompt);
    emitKeypressEvents(stdin);

    let password = "";
    const previousRawMode = stdin.isRaw ?? false;

    function cleanup() {
      stdin.removeListener("keypress", handleKeypress);
      stdin.setRawMode(previousRawMode);
      stdin.pause();
      stdout.write("\n");
    }

    function handleKeypress(
      character: string,
      key: { name?: string; ctrl?: boolean; meta?: boolean },
    ) {
      if (key.ctrl && key.name === "c") {
        cleanup();
        reject(new Error("Password entry cancelled."));
        return;
      }

      if (key.name === "return") {
        cleanup();
        resolve(password);
        return;
      }

      if (key.name === "backspace") {
        password = password.slice(0, -1);
        return;
      }

      if (character && !key.ctrl && !key.meta) {
        password += character;
      }
    }

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("keypress", handleKeypress);
  });
}

async function main() {
  try {
    const password = await askHiddenPassword(
      "Enter the initial Super Admin password: ",
    );

    if (password.length < 12 || Buffer.byteLength(password, "utf8") > 72) {
      throw new Error(
        "Password must be at least 12 characters and no more than 72 bytes.",
      );
    }

    const confirmPassword = await askHiddenPassword(
      "Confirm the Super Admin password: ",
    );

    if (password !== confirmPassword) {
      throw new Error("The passwords do not match.");
    }

    const existingUser = await pool.query(
      `SELECT id, role
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [SUPER_ADMIN_EMAIL],
    );

    if (existingUser.rows.length > 0) {
      throw new Error(
        `An account with this email already exists (role: ${existingUser.rows[0].role}). No changes were made.`,
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const result = await pool.query(
      `INSERT INTO users (full_name, email, password_hash, role, is_active)
       VALUES ($1, $2, $3, 'super_admin', true)
       RETURNING id, full_name, email, role, is_active`,
      ["Masha Sharon", SUPER_ADMIN_EMAIL, passwordHash],
    );

    console.log("\nSuper Admin account created successfully:");
    console.table(result.rows);
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(
    "\nSuper Admin setup failed:",
    error instanceof Error ? error.message : error,
  );

  process.exitCode = 1;
});
