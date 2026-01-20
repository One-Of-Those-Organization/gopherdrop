package main

// pion
import (
	"log"
	server "gopherdrop/server"
)

func main() {
	sec := getConfigFromEnv()

    db, err := server.OpenDB(sec.DBPath)
    if err != nil {
        log.Printf("Failed to open the db: %v", err)
        return
    }
    err = server.MigrateDB(db)
    if err != nil {
        log.Printf("Failed to mirgrate the db: %v", err)
        return
    }

	ser := server.InitServer(sec.Url, sec.Password)
	ser.SetupAllEndPoint()
	ser.StartServer()
}
