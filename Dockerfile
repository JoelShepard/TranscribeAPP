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

# Copia solo i file costruiti dallo stage precedente
COPY --from=builder /app/dist ./dist
# Copia package.json per riferimento (opzionale, ma utile per versionamento)
COPY --from=builder /app/package.json .

# Installa 'serve' globalmente o usalo via bunx per servire i file statici
# Espone la porta 3000
EXPOSE 3000

# Comando di avvio: bind esplicito su tutte le interfacce
CMD ["bun", "x", "serve", "dist", "--single", "--listen", "tcp://0.0.0.0:3000"]
