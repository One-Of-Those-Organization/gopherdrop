package main

// pion
import (
	helper "gopherdrop/helper"
	server "gopherdrop/server"
	"log"
)

func main() {
	sec := helper.GetConfigFromEnv()

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
	ser.DB = db
	server.StartJanitor(ser)
	ser.SetupAllEndPoint()
	ser.StartServer()
}
