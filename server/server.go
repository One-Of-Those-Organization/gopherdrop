package server

import (

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/websocket/v2"
	"gorm.io/gorm"
	"log"
	"sync"
	"time"
)

type ManagedUser struct {
	User      User            `json:"user"`
	Conn      *websocket.Conn `json:"-"`
	JWTExpiry time.Time       `json:"-"`
	// NOTE: will add the webrtc stuff later here
}

type Server struct {
	Url         string
	App         *fiber.App
	DB          *gorm.DB
	Pass        string
	Challenges  map[string]time.Time
	ChallengeMu sync.RWMutex
	MUser       map[*websocket.Conn]*ManagedUser
	MUserMu     sync.RWMutex
	CachedUser  []*ManagedUser
}

func InitServer(url string, password string) *Server {
	app := fiber.New(fiber.Config{
		AppName: "GopherDrop Backend Ow0",
	})
	app.Use(cors.New(cors.Config{
		AllowOrigins:     "*",
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
		AllowCredentials: false,
	}))
	return &Server{
		App:        app,
		Url:        url,
		Pass:       password,
		Challenges: make(map[string]time.Time),
		MUser:      make(map[*websocket.Conn]*ManagedUser),
	}
}

func (s *Server) StartServer() {
	log.Printf("Server started at: %s\nAccess via: http://localhost:8080\n", s.Url)
	s.App.Listen(s.Url)
}



func StartJanitor(s *Server) {
	go func() {
		for {
			time.Sleep(5 * time.Minute)
			s.ChallengeMu.Lock()
			for ch, expiry := range s.Challenges {
				if time.Now().After(expiry) {
					delete(s.Challenges, ch)
				}
			}
			s.ChallengeMu.Unlock()
		}
	}()
}

func CacheDiscoverableUser(s *Server) {
	for _, user := range s.MUser {
		if user.Conn != nil && user.User.IsDiscoverable {
			s.CachedUser = append(s.CachedUser, user)
		}
	}
}

func AddCachedUser(s *Server, user *ManagedUser) {
	s.CachedUser = append(s.CachedUser, user)
}

func DelCachedUser(s *Server, id int) {
	for i, user := range s.CachedUser {
		if user.User.ID == id {
			s.CachedUser[i] = s.CachedUser[len(s.CachedUser)-1]
			s.CachedUser[len(s.CachedUser)-1] = nil
			s.CachedUser = s.CachedUser[:len(s.CachedUser)-1]
			return
		}
	}
}
