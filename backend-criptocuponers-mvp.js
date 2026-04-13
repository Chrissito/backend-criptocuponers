import express from "express";
import dotenv from "dotenv";
import { Wallet, TokenSendRequest } from "mainnet-js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY;
const TOKEN_CATEGORY = process.env.TOKEN_CATEGORY;

let wallet;

async function initWallet() {
  if (!process.env.WALLET_WIF) {
    throw new Error("Falta WALLET_WIF");
  }
  wallet = await Wallet.fromWIF(process.env.WALLET_WIF);
}

async function getDebugInfo() {
  const tokenBalance = await wallet.getTokenBalance(TOKEN_CATEGORY);
  const tokenUtxos = await wallet.getTokenUtxos(TOKEN_CATEGORY);

  return {
    cashaddr: wallet.cashaddr,
    tokenaddr: wallet.tokenaddr,
    tokenBalance: tokenBalance.toString(),
    tokenUtxoCount: tokenUtxos.length,
    tokenCategory: TOKEN_CATEGORY
  };
}

app.get("/health", async (_req, res) => {
  try {
    const info = await getDebugInfo();
    res.json({ ok: true, ...info });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// prueba directa: manda 1 token a la MISMA tokenaddr del backend
app.post("/selftest", async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== API_KEY) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const before = await getDebugInfo();
    console.log("SELFTEST BEFORE:", JSON.stringify(before));

    const tx = await wallet.send([
      new TokenSendRequest({
        cashaddr: wallet.tokenaddr,
        category: TOKEN_CATEGORY,
        amount: 1n,
        value: 1000n
      })
    ]);

    const after = await getDebugInfo();
    console.log("SELFTEST AFTER:", JSON.stringify(after));

    res.json({
      ok: true,
      txid: tx.txId,
      before,
      after
    });
  } catch (error) {
    console.error("SELFTEST ERROR:", error?.message || String(error));
    res.status(500).json({ error: error.message });
  }
});

app.post("/reward", async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== API_KEY) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const { monto, walletDestino } = req.body;

    if (!Number.isFinite(Number(monto))) {
      return res.status(400).json({ error: "Monto inválido" });
    }

    if (!walletDestino) {
      return res.status(400).json({ error: "Wallet destino vacía" });
    }

    const recompensa = Math.floor((Number(monto) * 10) / 100);

    const before = await getDebugInfo();
    console.log("REWARD REQUEST:", JSON.stringify({
      monto,
      walletDestino,
      recompensa,
      before
    }));

    const tx = await wallet.send([
      new TokenSendRequest({
        cashaddr: walletDestino,
        category: TOKEN_CATEGORY,
        amount: BigInt(recompensa),
        value: 1000n
      })
    ]);

    console.log("REWARD SENT:", JSON.stringify({
      txid: tx.txId,
      recompensa
    }));

    res.json({
      ok: true,
      recompensa,
      txid: tx.txId
    });
  } catch (error) {
    console.error("REWARD ERROR:", error?.message || String(error));
    res.status(500).json({ error: error.message });
  }
});

initWallet()
  .then(async () => {
    const info = await getDebugInfo();
    console.log("WALLET INFO:", info);

    app.listen(PORT, () => {
      console.log("Servidor corriendo en puerto", PORT);
    });
  })
  .catch((error) => {
    console.error("Error al iniciar wallet:", error);
    process.exit(1);
  });
