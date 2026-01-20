package server

import (
	"log"
	"github.com/gofiber/fiber/v2"
)

type Server struct {
	Url string
    App *fiber.App
}

func InitServer(url string) *Server {
    return &Server{
        App: fiber.New(),
		Url: url,
    }
}

func (s *Server)StartServer() {
	log.Printf("Server started at: %s\n", s.Url)
	s.App.Listen(s.Url)
}
