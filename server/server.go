package server

import (
	"log"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/websocket/v2"
	"gorm.io/gorm"
)

// User struct is defined in database.go

type MinimalUser struct {
	Username  string `json:"username"`
	PublicKey string `json:"public_key"`
}

type ManagedUser struct {
	MinUser   MinimalUser     `json:"user"`
	User      User            `json:"-"`
	Conn      *websocket.Conn `json:"-"`
	JWTExpiry time.Time       `json:"-"`
}

type Transaction struct {
	ID      string               `json:"id"`
	Sender  *ManagedUser         `json:"-"`
	Targets []*TransactionTarget `json:"-"`
	Files   []*FileInfo          `json:"files"`
	Started bool                 `json:"started"`
}

type TargetStatus int

const (
	Pending TargetStatus = iota
	Accepted
	Declined
)

type TransactionTarget struct {
	User   *ManagedUser
	Status TargetStatus
}

type FileInfo struct {
	Name string `json:"name"`
	Size int64  `json:"size"`
	Type string `json:"type"`
}

type Server struct {
	Url           string
	App           *fiber.App
	DB            *gorm.DB
	Pass          string
	Challenges    map[string]time.Time
	ChallengeMu   sync.RWMutex
	MUser         map[*websocket.Conn]*ManagedUser
	MUserMu       sync.RWMutex
	CachedUser    []*ManagedUser
	Transactions  map[string]*Transaction
	TransactionMu sync.RWMutex
}

func InitServer(url string, password string) *Server {
	// DB is initialized in main.go and assigned to Server.DB

	app := fiber.New(fiber.Config{
		AppName: "GopherDrop Backend Ow0",
	})

	app.Use(cors.New(cors.Config{
		AllowOriginsFunc: func(origin string) bool {
			return origin == "https://dev-gopherdrop.vercel.app" ||
				origin == "http://localhost:3000" ||
				origin == "http://localhost:5173"
		},
		AllowCredentials: true,
		AllowHeaders:     "Origin, Content-Type, Accept, Authorization, Upgrade, Connection, ngrok-skip-browser-warning",
		AllowMethods:     "GET, POST, PUT, DELETE, OPTIONS",
	}))

	app.Options("/*", func(c *fiber.Ctx) error {
		return c.SendStatus(fiber.StatusNoContent)
	})

	return &Server{
		App:          app,
		Url:          url,
		DB:           nil,
		Pass:         password,
		Challenges:   make(map[string]time.Time),
		MUser:        make(map[*websocket.Conn]*ManagedUser),
		Transactions: make(map[string]*Transaction),
	}
}

func (s *Server) StartServer() {
	log.Printf("Server starting at: %s\n", s.Url)
	if err := s.App.Listen(s.Url); err != nil {
		log.Fatal(err)
	}
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
	s.CachedUser = make([]*ManagedUser, 0, len(s.MUser))
	for _, user := range s.MUser {
		if user.Conn != nil && user.User.IsDiscoverable {
			s.CachedUser = append(s.CachedUser, user)
		}
	}
}

func AddCachedUser(s *Server, user *ManagedUser) {
	if user.User.IsDiscoverable {
		s.CachedUser = append(s.CachedUser, user)
	}
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
