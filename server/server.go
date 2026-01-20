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
	api_pub := s.App.Group("/api/v1/")

	// GET: /
	// testing the server if its running.
	SetupRoot(s)

	// POST: /api/v1/register
	// to register from the name client provided
	// - data: username: string
	SetupRegister(s, api_pub)

	// POST: /api/v1/login
	// to login from the generated password and id
	// - data: id: int, password string
	SetupLogin(s, api_pub)
}
