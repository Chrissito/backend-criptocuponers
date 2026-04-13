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

async function getDebugInfo() {
  const bchBalance = await wallet.getBalance();
  const tokenBalance = await wallet.getTokenBalance(TOKEN_CATEGORY);
  const tokenUtxos = await wallet.getTokenUtxos(TOKEN_CATEGORY);

  return {
    cashaddr: wallet.cashaddr,
    tokenaddr: wallet.tokenaddr,
    bchBalance: bchBalance.toString(),
    tokenBalance: tokenBalance.toString(),
    tokenUtxoCount: tokenUtxos.length,
    tokenCategory: TOKEN_CATEGORY
  };
}

app.get("/health", async (req, res) => {
  try {
    const info = await getDebugInfo();
    res.json({
      ok: true,
      ...info
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      error: error.message
    });
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

    const recompensa = calcularRecompensa(Number(monto));
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

initWallet()
  .then(async () => {
    const info = await getDebugInfo();
    console.log("DEBUG WALLET INFO:", info);

    app.listen(PORT, () => {
      console.log("Servidor corriendo en puerto", PORT);
    });
  })
  .catch((error) => {
    console.error("Error al iniciar wallet:", error);
    process.exit(1);
  });
