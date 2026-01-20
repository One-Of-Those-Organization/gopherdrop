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


func (s *Server)SetupAllEndPoint() {
	// GET: /
	// testing the server if its running.
	s.App.Get("/", func (c *fiber.Ctx) error {
		return c.SendString("Server is online")
	})

	// GET: /register
	// to register from the name client provided
	s.App.Get("/register", func (c *fiber.Ctx) error {
		return c.SendString("WIP")
	})
}
