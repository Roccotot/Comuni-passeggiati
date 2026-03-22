package main

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"time"
)

const port = "8080"

func main() {
	exe, err := os.Executable()
	if err != nil {
		fmt.Println("Errore:", err)
		os.Exit(1)
	}
	dir := filepath.Dir(exe)
	saveFile := filepath.Join(dir, "salvataggi", "comuni-passeggiati.json")

	// Assicura che la cartella salvataggi esista
	os.MkdirAll(filepath.Join(dir, "salvataggi"), 0755)

	// Serve i file statici
	http.Handle("/", http.FileServer(http.Dir(dir)))

	// POST /save  →  scrive salvataggi/comuni-passeggiati.json
	http.HandleFunc("/save", func(w http.ResponseWriter, r *http.Request) {
		if r.Method != "POST" {
			http.Error(w, "Method not allowed", 405)
			return
		}
		body, err := io.ReadAll(r.Body)
		if err != nil {
			http.Error(w, err.Error(), 500)
			return
		}
		// Verifica che sia JSON valido
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
	fmt.Println("  Server avviato su " + url)
	fmt.Println("  Il browser si apre automaticamente.")
	fmt.Println("")
	fmt.Println("  Tieni questa finestra aperta.")
	fmt.Println("  Chiudila quando hai finito.")
	fmt.Println("=========================================")

	if err := http.ListenAndServe("127.0.0.1:"+port, nil); err != nil {
		fmt.Println("Errore:", err)
		time.Sleep(3 * time.Second)
		os.Exit(1)
	}
}
