# Usa l'immagine ufficiale di Bun
FROM docker.io/oven/bun:1 AS builder

# Imposta la directory di lavoro
WORKDIR /app

# Copia i file di configurazione delle dipendenze
COPY package.json bun.lock ./

# Installa le dipendenze
RUN bun install --frozen-lockfile

# Copia il resto del codice sorgente
COPY . .

# Esegui la build del progetto (genera la cartella dist/)
RUN bun run build

# --- Stage di produzione ---
FROM docker.io/oven/bun:1-slim

WORKDIR /app

# Copia solo i file costruiti dallo stage precedente e lo script del server
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/server.ts .
# Copia package.json per riferimento
COPY --from=builder /app/package.json .

# Espone la porta 3000
EXPOSE 3000

# Comando di avvio: usa lo script del server Bun che include il proxy DeepL
CMD ["bun", "run", "server.ts"]
