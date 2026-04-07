import express from "express";
import fetch from "node-fetch";

const app = express();
app.use(express.json());

app.get("/", (req, res) => {
  res.send("MCP Demo Server is running");
});

app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

app.post("/mcp", async (req, res) => {
  const { jsonrpc, method, params, id } = req.body;

  // Optional: basic guard for malformed requests
  if (jsonrpc && jsonrpc !== "2.0") {
    return res.json({
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code: -32600,
        message: "Invalid JSON-RPC version"
      }
    });
  }

  try {
    if (method === "initialize") {
      return res.json({
        jsonrpc: "2.0",
        id: id ?? null,
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

    if (method === "tools/list") {
      return res.json({
        jsonrpc: "2.0",
        id: id ?? null,
        result: {
          tools: [
            {
              name: "get_weather",
              description: "Get current weather by zip code",
              inputSchema: {
                type: "object",
                properties: {
                  zip: {
                    type: "string",
                    description: "US ZIP code, for example 90210"
                  }
                },
                required: ["zip"]
              }
            },
            {
              name: "get_stock_price",
              description: "Get stock price by ticker symbol",
              inputSchema: {
                type: "object",
                properties: {
                  symbol: {
                    type: "string",
                    description: "Stock ticker symbol, for example AAPL"
                  }
                },
                required: ["symbol"]
              }
            }
          ]
        }
      });
    }

    if (method === "tools/call") {
      const toolName = params?.name;
      const args = params?.arguments || {};

      if (toolName === "get_weather") {
        const zip = args.zip;

        if (!zip) {
          return res.json({
            jsonrpc: "2.0",
            id: id ?? null,
            error: {
              code: -32602,
              message: "Missing required argument: zip"
            }
          });
        }

        const geoRes = await fetch(
          `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(zip)}`
        );
        const geoData = await geoRes.json();

        if (!geoData.results || geoData.results.length === 0) {
          return res.json({
            jsonrpc: "2.0",
            id: id ?? null,
            result: {
              content: [
                {
                  type: "text",
                  text: `No location found for ZIP code ${zip}.`
                }
              ],
              isError: true
            }
          });
        }

        const { latitude, longitude, name, admin1, country } = geoData.results[0];

        const weatherRes = await fetch(
          `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true`
        );
        const weatherData = await weatherRes.json();

        const current = weatherData.current_weather;

        if (!current) {
          return res.json({
            jsonrpc: "2.0",
            id: id ?? null,
            result: {
              content: [
                {
                  type: "text",
                  text: `Weather data was unavailable for ${zip}.`
                }
              ],
              isError: true
            }
          });
        }

        return res.json({
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            content: [
              {
                type: "text",
                text:
                  `Current weather for ${name}${admin1 ? `, ${admin1}` : ""}${country ? `, ${country}` : ""}: ` +
                  `${current.temperature}°C, wind speed ${current.windspeed} km/h, weather code ${current.weathercode}.`
              }
            ]
          }
        });
      }

      if (toolName === "get_stock_price") {
        const symbol = args.symbol;

        if (!symbol) {
          return res.json({
            jsonrpc: "2.0",
            id: id ?? null,
            error: {
              code: -32602,
              message: "Missing required argument: symbol"
            }
          });
        }

        const stockRes = await fetch(
          `https://www.alphavantage.co/query?function=GLOBAL_QUOTE&symbol=${encodeURIComponent(symbol)}&apikey=CEW9VQILKSPTQNTC`
        );
        const stockData = await stockRes.json();
        const quote = stockData["Global Quote"];

        if (!quote || Object.keys(quote).length === 0) {
          return res.json({
            jsonrpc: "2.0",
            id: id ?? null,
            result: {
              content: [
                {
                  type: "text",
                  text: `No stock quote found for symbol ${symbol}.`
                }
              ],
              isError: true
            }
          });
        }

        return res.json({
          jsonrpc: "2.0",
          id: id ?? null,
          result: {
            content: [
              {
                type: "text",
                text:
                  `Stock quote for ${symbol.toUpperCase()}: ` +
                  `price ${quote["05. price"]}, ` +
                  `open ${quote["02. open"]}, ` +
                  `high ${quote["03. high"]}, ` +
                  `low ${quote["04. low"]}, ` +
                  `latest trading day ${quote["07. latest trading day"]}.`
              }
            ]
          }
        });
      }

      return res.json({
        jsonrpc: "2.0",
        id: id ?? null,
        error: {
          code: -32601,
          message: `Unknown tool: ${toolName}`
        }
      });
    }

    return res.json({
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code: -32601,
        message: `Method not found: ${method}`
      }
    });
  } catch (err) {
    console.error("MCP error:", err);

    return res.json({
      jsonrpc: "2.0",
      id: id ?? null,
      error: {
        code: -32603,
        message: err.message || "Internal server error"
      }
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`MCP server running on port ${PORT}`);
});
