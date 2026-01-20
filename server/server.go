package server

import (
	"time"
	"math/rand"
	"log"
	"github.com/gofiber/fiber/v2"
	// jwtware "github.com/gofiber/contrib/jwt"
	"gorm.io/gorm"
)

type Server struct {
	Url	 string
	App  *fiber.App
	DB   *gorm.DB
	Pass string
	Rand *rand.Rand
}

func InitServer(url string, password string) *Server {
	rand_t := rand.New(rand.NewSource(time.Now().UnixNano()))
	app := fiber.New(fiber.Config{
        AppName: "GopherDrop Backend Ow0",
    })
    return &Server{
        App: app,
		Url: url,
		Rand: rand_t,
		Pass: password,
    }
}

func (s *Server)StartServer() {
	log.Printf("Server started at: %s\n", s.Url)
	s.App.Listen(s.Url)
}

func (s *Server)SetupAllEndPoint() {
	api_pub := s.App.Group("/api/v1/")
    // protected := api_pub.Group("/protected", jwtware.New(jwtware.Config{
    //     SigningKey: jwtware.SigningKey{Key: []byte(s.Pass)},
    // }))

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
