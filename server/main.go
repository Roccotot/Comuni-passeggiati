package main

import (
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"time"
)

func main() {
	// Serve i file dalla cartella dove si trova l'exe
	exe, err := os.Executable()
	if err != nil {
		exe = "."
	}
	dir := filepath.Dir(exe)

	port := "8080"

	// Se la porta è occupata, prova le successive
	for p := 8080; p <= 8090; p++ {
		port = fmt.Sprintf("%d", p)
		ln, err := net.Listen("tcp", "127.0.0.1:"+port)
		if err == nil {
			ln.Close()
			break
		}
	}

	url := "http://localhost:" + port

	http.Handle("/", http.FileServer(http.Dir(dir)))

	go func() {
		time.Sleep(400 * time.Millisecond)
		exec.Command("rundll32", "url.dll,FileProtocolHandler", url).Start()
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
