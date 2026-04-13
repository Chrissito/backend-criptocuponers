import express from "express";
import dotenv from "dotenv";
import { Wallet, TokenSendRequest } from "mainnet-js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY;

const TOKEN_CATEGORY = process.env.TOKEN_CATEGORY;
const TOKEN_DECIMALS = Number(process.env.TOKEN_DECIMALS || 2);
const REWARD_PERCENT = Number(process.env.REWARD_PERCENT || 10);

let wallet;

async function initWallet() {
  if (process.env.WALLET_WIF) {
    wallet = await Wallet.fromWIF(process.env.WALLET_WIF);
  } else if (process.env.WALLET_SEED) {
    wallet = await Wallet.fromSeed(process.env.WALLET_SEED);
  } else {
    throw new Error("Falta WALLET_WIF o WALLET_SEED en Render");
  }
}

function calcularRecompensa(monto) {
  return (monto * REWARD_PERCENT) / 100;
}

function aUnidadesBase(tokens) {
  return BigInt(Math.round(tokens * 10 ** TOKEN_DECIMALS));
}

app.get("/health", (req, res) => {
  res.json({ ok: true });
});

app.post("/reward", async (req, res) => {
  try {
    if (req.headers["x-api-key"] !== API_KEY) {
      return res.status(401).json({ error: "No autorizado" });
    }

    const { monto, walletDestino } = req.body;

    const recompensa = calcularRecompensa(monto);
    const baseUnits = aUnidadesBase(recompensa);

    const tx = await wallet.send([
      new TokenSendRequest({
        cashaddr: walletDestino,
        category: TOKEN_CATEGORY,
        amount: baseUnits,
        value: 1000n
      })
    ]);

    res.json({
      ok: true,
      recompensa,
      txid: tx.txId
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

initWallet().then(() => {
  app.listen(PORT, () => {
    console.log("Servidor corriendo en puerto", PORT);
  });
});
