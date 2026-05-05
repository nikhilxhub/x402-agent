import express from "express";
import { premiumRouter } from "./routes/premiumRouter";
import cors from "cors";
import { attachRequestContext, logInfo } from "./utils/logging";

const app = express();
app.use(cors());
app.use(express.json());
app.use(attachRequestContext);

app.use("/premium", premiumRouter);

app.get("/health", (_req, res) => res.json({ ok: true }));

app.listen(3000, () => {
  logInfo("Server", "listening", {
    port: 3000,
  });
});
