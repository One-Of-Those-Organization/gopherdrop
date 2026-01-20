package main

// pion
// gorm
// jwt
import (
	"fmt"
	server "gopherdrop/server"
)

func main() {
	// TODO: use env to change the port
	var ip string = "0.0.0.0"
	var port string = "8000"
	combined := fmt.Sprintf("%s:%s", ip, port)

	ser := server.InitServer(combined)
	ser.SetupAllEndPoint()
	ser.StartServer()
}
