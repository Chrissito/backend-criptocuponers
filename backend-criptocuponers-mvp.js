import express from "express";
import dotenv from "dotenv";
import { Wallet, TokenSendRequest } from "mainnet-js";

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 10000;
const API_KEY = process.env.API_KEY;

const TOKEN_CATEGORY = process.env.TOKEN_CATEGORY;
const REWARD_PERCENT = Number(process.env.REWARD_PERCENT || 10);

let wallet;

// Inicializar wallet
async function initWallet() {
  if (process.env.WALLET_WIF) {
    wallet = await Wallet.fromWIF(process.env.WALLET_WIF);
  } else {
    throw new Error("Falta WALLET_WIF en Render");
  }
}

// Calcular recompensa
function calcularRecompensa(monto) {
  return Math.floor((monto * REWARD_PERCENT) / 100);
}

// Endpoint de salud (debug)
app.get("/health", async (req, res) => {
  try {
    const bchBalance = await wallet.getBalance();
    const tokenBalance = await wallet.getTokenBalance(TOKEN_CATEGORY);
    const tokenUtxos = await wallet.getTokenUtxos(TOKEN_CATEGORY);

    res.json({
      ok: true,
      cashaddr: wallet.cashaddr,
      tokenaddr: wallet.tokenaddr,
      bchBalance: bchBalance.toString(),
      tokenBalance: tokenBalance.toString(),
      tokenUtxoCount: tokenUtxos.length,
      tokenCategory: TOKEN_CATEGORY
    });
  } catch (error) {
    res.status(500).json({ ok: false, error: error.message });
  }
});

// Endpoint para enviar recompensa
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

    const tx = await wallet.send([
      new TokenSendRequest({
        cashaddr: walletDestino,
        category: TOKEN_CATEGORY,
        amount: BigInt(recompensa), // 🔥 SIN DECIMALES (arreglado)
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

// Arranque
initWallet()
  .then(() => {
    console.log("Wallet lista:", wallet.cashaddr);

    app.listen(PORT, () => {
      console.log("Servidor corriendo en puerto", PORT);
    });
  })
  .catch((error) => {
    console.error("Error al iniciar wallet:", error);
    process.exit(1);
  });
