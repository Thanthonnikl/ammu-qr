const express = require("express");
const app = express();
const path = require("path");
const fs = require("fs-extra");
const http = require("http");
const { tmpdir } = require("os");
const router = express.Router();
const Jimp = require("jimp");
const { toBuffer } = require("qrcode");
const CryptoJS = require("crypto-js");
const axios = require("axios");
console.log("Starting...");
const {
  delay,
  useMultiFileAuthState,
  BufferJSON,
  fetchLatestBaileysVersion,
  Browsers,
  makeWASocket,
} = require("@whiskeysockets/baileys");
const pino = require("pino");
const PORT = process.env.PORT || 3031;

app.use("/static", express.static(path.join(__dirname, "./public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "./public/index.html"));
});

app.get("/qr", (req, res) => {
  const userId = req.query.id;
  const qrImagePath = path.join(__dirname, "./public", `qr_${userId}.png`);

  deleteAllPNGFiles(path.join(__dirname, "./public"));

  async function XAsena() {
    try {
      let { version, isLatest } = await fetchLatestBaileysVersion();
      let tempfolder = tmpdir();
      const { state, saveCreds } = await useMultiFileAuthState(tempfolder);
      const session = makeWASocket({
        logger: pino({
          level: "silent",
        }),
        printQRInTerminal: false,
        browser: Browsers.macOS("Desktop"),
        auth: state,
        version,
      });

      session.ev.on("connection.update", async (s) => {
        if (s.qr) {
          Jimp.read(await toBuffer(s.qr), async (err, image) => {
            if (err) throw err;

            try {
              await image.writeAsync(qrImagePath);
              console.log("image saved");

              const qrBase64 = fs.readFileSync(qrImagePath, {
                encoding: "base64",
              });
              const htmlTemplate = fs.readFileSync(
                path.join(__dirname, "./public", "qr.html"),
                "utf-8",
              );
              const finalHtml = htmlTemplate
                .replace("{QR_CODE}", qrBase64)
                .replace("{USER_ID}", userId);
              res.send(finalHtml);
            } catch (writeErr) {
              console.error("Error saving image:", writeErr);
            }
          });
        }

        const { connection, lastDisconnect } = s;
        if (connection === "open") {
          const authfile = `${tempfolder}/creds.json`;
          await delay(1000 * 10);
          const CREDS = fs.readFileSync(authfile);
          try {
            const response = await axios.get(
              "https://uploader.alpha-md.rf.gd/paste",
              {
                params: {
                  content: JSON.stringify(CREDS),
                  apikey: "admin",
                },
              },
            );
            const pasteId = response.data.id;
            await session.sendMessage(session.user.id, {
              text: pasteId,
            });
            await session.sendMessage(session.user.id, {
              text: "\n*ᴅᴇᴀʀ ᴜsᴇʀ ᴛʜɪs ɪs ʏᴏᴜʀ sᴇssɪᴏɴ ɪᴅ*\n◕ ⚠️ *ᴘʟᴇᴀsᴇ ᴅᴏ ɴᴏᴛ sʜᴀʀᴇ ᴛʜɪs ᴄᴏᴅᴇ ᴡɪᴛʜ ᴀɴʏᴏɴᴇ ᴀs ɪᴛ ᴄᴏɴᴛᴀɪɴs ʀᴇǫᴜɪʀᴇᴅ ᴅᴀᴛᴀ ᴛᴏ ɢᴇᴛ ʏᴏᴜʀ ᴄᴏɴᴛᴀᴄᴛ ᴅᴇᴛᴀɪʟs ᴀɴᴅ ᴀᴄᴄᴇss ʏᴏᴜʀ ᴡʜᴀᴛsᴀᴘᴘ*",
            });

            await session.sendMessage(session.user.id, {
              document: {
                url: authfile,
              },
              fileName: "creds.json",
              mimetype: "application/json",
            });
            await delay(3000);
            fs.unlinkSync(authfile);
            await delay(1000 * 10);
            process.exit(0);
          } catch (err) {
            console.error("Error uploading to Pastebin:", err);
          }
        }

        if (
          connection === "close" &&
          lastDisconnect &&
          lastDisconnect.error &&
          lastDisconnect.error.output.statusCode != 401
        ) {
          XAsena();
        }
      });

      session.ev.on("creds.update", saveCreds);
      await delay(3000 * 10);
      session.ev.on("messages.upsert", () => {});
    } catch (err) {
      console.log(
        err + "Unknown Error Occurred. Please report to Owner and Stay tuned",
      );
    }
  }

  XAsena();
});

const server = http.createServer(app);
server.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

function generateRandomUserId() {
  const randomBytes = require("crypto").randomBytes(7);
  return randomBytes.toString("hex");
}

function deleteAllPNGFiles(folderPath) {
  fs.readdirSync(folderPath).forEach((file) => {
    if (file.endsWith(".png")) {
      fs.unlinkSync(path.join(folderPath, file));
      console.log(`Deleted: ${file}`);
    }
  });
}
