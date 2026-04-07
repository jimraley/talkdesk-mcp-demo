import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

// Root check (helps with Railway health checks)
app.get("/", (req, res) => {
  res.send("MCP Demo Server is running");
});

// Tool discovery
app.get("/tools", (req, res) => {
  res.json({
    tools: [
      {
        name: "get_weather",
        description: "Get current weather by zip code",
        input_schema: {
          type: "object",
          properties: {
            zip: { type: "string" }
          },
          required: ["zip"]
        }
      },
      {
        name: "get_stock_price",
        description: "Get stock price by symbol",
        input_schema: {
          type: "object",
          properties: {
            symbol: { type: "string" }
          },
          required: ["symbol"]
        }
      }
    ]
  });
});

// Tool execution
app.post("/call", async (req, res) => {
  const { name, arguments: args } = req.body;

  try {
    if (name === "get_weather") {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${args.zip}`
      );
      const geoData = await geoRes.json();

      if (!geoData.results || geoData.results.length === 0) {
        return res.status(400).json({ error: "Invalid zip code" });
      }

      const { latitude, longitude } = geoData.results[0];

      const weatherRes = await fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
      );
      const weatherData = await weatherRes.json();

      return res.json({
        result: weatherData.current_weather
      });
    }

    if (name === "get_stock_price") {
      const stockRes = await fetch(
        `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${args.symbol}&apikey=demo`
      );
      const stockData = await stockRes.json();

      return res.json({
        result: stockData["Global Quote"]
      });
    }

    return res.status(400).json({ error: "Unknown tool" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

app.post("/mcp", async (req, res) => {
  const { method, params, id } = req.body;

  try {
    // REQUIRED handshake
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "railway-mcp-demo",
            version: "1.0.0"
          }
        }
      });
    }

    // Tool discovery
    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "get_weather",
              description: "Get current weather by zip code",
              inputSchema: {
                type: "object",
                properties: {
                  zip: { type: "string" }
                },
                required: ["zip"]
              }
            },
            {
              name: "get_stock_price",
              description: "Get stock price by symbol",
              inputSchema: {
                type: "object",
                properties: {
                  symbol: { type: "string" }
                },
                required: ["symbol"]
              }
            }
          ]
        }
      });
    }

    // Tool execution
    if (method === "tools/call") {
      const { name, arguments: args } = params;

      let resultText = "";

      if (name === "get_weather") {
        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${args.zip}`
        );
        const geoData = await geoRes.json();

        const { latitude, longitude } = geoData.results[0];

        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );
        const weatherData = await weatherRes.json();

        resultText = JSON.stringify(weatherData.current_weather);
      }

      if (name === "get_stock_price") {
        const stockRes = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${args.symbol}&apikey=demo`
        );
        const stockData = await stockRes.json();

        resultText = JSON.stringify(stockData["Global Quote"]);
      }

      return res.json({
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: resultText
            }
          ]
        }
      });
    }

    return res.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32601,
        message: "Method not found"
      }
    });

  } catch (err) {
    return res.json({
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: err.message
      }
    });
  }
});

    return res.status(400).json({ error: "Unknown method" });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
});
