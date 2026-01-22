package server

import (
	"gopherdrop/helper"
	"log"
	"sync"
	"time"

	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

type User struct {
	gorm.Model
	MinimalUser    `gorm:"embedded"`
	IsDiscoverable bool `json:"is_discoverable"`
	// Add other fields if necessary based on usage in route.go
}

type MinimalUser struct {
	Username  string `json:"username"`
	PublicKey string `json:"public_key"`
}

type ManagedUser struct {
	MinUser   MinimalUser
	User      User
	Conn      *websocket.Conn
	JWTExpiry time.Time
}

type Server struct {
	Url         string
	App         *fiber.App
	DB          *gorm.DB
	Pass        string
	Challenges  map[string]time.Time
	ChallengeMu sync.Mutex
	MUser       map[*websocket.Conn]*ManagedUser
	MUserMu     sync.Mutex
	CachedUser  []MinimalUser
}

func InitServer(url string) *Server {
	cfg := helper.GetConfigFromEnv()
	db, err := gorm.Open(sqlite.Open(cfg.DBPath), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		log.Fatal("failed to connect database")
	}

	// Migrate the schema
	db.AutoMigrate(&User{})

	return &Server{
		App:        fiber.New(),
		Url:        url,
		DB:         db,
		Pass:       cfg.Password,
		Challenges: make(map[string]time.Time),
		MUser:      make(map[*websocket.Conn]*ManagedUser),
	}
}

func (s *Server) StartServer() {
	log.Printf("Server started at: %s\n", s.Url)
	s.App.Listen(s.Url)
}
