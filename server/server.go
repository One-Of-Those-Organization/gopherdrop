package server

import (
	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/fiber/v2/middleware/cors"
	"github.com/gofiber/websocket/v2"
	"gorm.io/gorm"
	"log"
	"sync"
	"time"
)

type MinimalUser struct {
	Username  string `json:"username"`
	PublicKey string `json:"public_key"`
}

type ManagedUser struct {
	MinUser   MinimalUser     `json:"user"`
	User      User            `json:"-"`
	Conn      *websocket.Conn `json:"-"`
	JWTExpiry time.Time       `json:"-"`
	// NOTE: will add the webrtc stuff later here
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
	Pending   TargetStatus = iota
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
		App:          app,
		Url:          url,
		Pass:         password,
		Challenges:   make(map[string]time.Time),
		MUser:        make(map[*websocket.Conn]*ManagedUser),
		Transactions: make(map[string]*Transaction),
	}
}

func (s *Server) StartServer() {
	log.Printf("Server started at: %s\n", s.Url)
	s.App.Listen(s.Url)
}

func (s *Server) SetupAllEndPoint() {
	api_pub := s.App.Group("/api/v1/")
	protected := api_pub.Group("/protected", jwtware.New(jwtware.Config{
		SigningKey: jwtware.SigningKey{Key: []byte(s.Pass)},
	}))

	// GET: /
	SetupStaticFrontEnd(s)

	// POST: /api/v1/register
	// to register from the name client provided
	// - data: username: string
	SetupRegister(s, api_pub)

	// POST: /api/v1/login
	// to login from the generated password and id
	// - data: public_key string, challenge string, signature string
	// NOTE: the challenge is the exact same stuff you got from the `SetupChallenge` and the result
	//       of sign with your private key is `signature`.
	SetupLogin(s, api_pub)

	// GET: /api/v1/challenge
	// to get challenge for logging in
	SetupChallange(s, api_pub)

	// GET: /api/v1/protected/ws
	// to upgrade the connection to websocket for later
	// use (listing all the near ppl, conn to webrtc)
	SetupWebSocketEndPoint(s, protected)
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
