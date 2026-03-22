package main

import (
	"embed"
	"encoding/json"
	"fmt"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

//go:embed static
var staticFiles embed.FS

const port = "8080"

func main() {
	// Percorso del file JSON accanto all'exe
	exe, err := os.Executable()
	if err != nil {
		fmt.Println("Errore:", err)
		os.Exit(1)
	}
	saveFile := filepath.Join(filepath.Dir(exe), "comuni-passeggiati.json")

	// Sottocartella "static" dall'embedded FS
	sub, err := fs.Sub(staticFiles, "static")
	if err != nil {
		fmt.Println("Errore embed:", err)
		os.Exit(1)
	}

	mux := http.NewServeMux()

	// File statici (HTML, JS, CSS) — tutti incorporati nell'exe
	mux.Handle("/", http.FileServer(http.FS(sub)))

	// GET /load — legge comuni-passeggiati.json accanto all'exe
	mux.HandleFunc("/load", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		data, err := os.ReadFile(saveFile)
		if err != nil {
			w.Write([]byte("{}"))
			return
		}
		w.Write(data)
	})

	// POST /save — scrive comuni-passeggiati.json accanto all'exe
	mux.HandleFunc("/save", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", 405)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		var v interface{}
		if err := json.Unmarshal(body, &v); err != nil {
			http.Error(w, "JSON non valido", 400)
			return
		}
		if err := os.WriteFile(saveFile, body, 0644); err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		w.WriteHeader(200)
	})

	url := "http://localhost:" + port

	go func() {
		time.Sleep(400 * time.Millisecond)
		openBrowser(url)
	}()

	fmt.Println("=========================================")
	fmt.Println("  Comuni Passeggiati")
	fmt.Println("=========================================")
	fmt.Println("  Avviato su " + url)
	fmt.Println("  Tieni questa finestra aperta.")
	fmt.Println("  Chiudila quando hai finito.")
	fmt.Println("=========================================")

	if err := http.ListenAndServe("127.0.0.1:"+port, mux); err != nil {
		fmt.Println("Errore:", err)
		time.Sleep(3 * time.Second)
		os.Exit(1)
	}
}
