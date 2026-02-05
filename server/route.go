package server

import (
	"fmt"
	"gopherdrop/helper"
	"log"
	"time"

	jwtware "github.com/gofiber/contrib/jwt"
	"github.com/gofiber/fiber/v2"
	"github.com/gofiber/websocket/v2"
	"github.com/golang-jwt/jwt/v5"
)

var Counter int = 0

type Ret struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
	Error   int    `json:"code"`
	Data    any    `json:"data"`
}

func cret(Success bool, Message string, Data any) Ret {
	Counter += 1
	return Ret{Success, Message, Counter - 1, Data}
}

func resp(c *fiber.Ctx, ret Ret, code int) error {
	return c.Status(code).JSON(ret)
}

func SetupRegister(s *Server, group fiber.Router) {
	group.Post("/register", func(c *fiber.Ctx) error {
		var b struct {
			Username  string `json:"username"`
			PublicKey string `json:"public_key"`
		}

		if err := c.BodyParser(&b); err != nil {
			return resp(c, cret(false, "Invalid body", nil), fiber.StatusBadRequest)
		}

		if b.Username == "" || b.PublicKey == "" {
			return resp(c, cret(false, "Username and PublicKey are required", nil), fiber.StatusBadRequest)
		}

		newUser := User{
			Username:       b.Username,
			PublicKey:      b.PublicKey,
			CreatedAt:      time.Now(),
			IsDiscoverable: true,
		}

		if err := s.DB.Create(&newUser).Error; err != nil {
			return resp(c, cret(false, "Username might already exist", nil), fiber.StatusBadRequest)
		}

		return resp(c, cret(true, "user", newUser), fiber.StatusOK)
	})
}

func SetupChallange(s *Server, group fiber.Router) {
	if s.Challenges == nil {
		s.Challenges = make(map[string]time.Time)
	}
	group.Get("/challenge", func(c *fiber.Ctx) error {
		challenge, _ := helper.GenerateChallenge()
		s.ChallengeMu.Lock()
		s.Challenges[challenge] = time.Now().Add(2 * time.Minute)
		s.ChallengeMu.Unlock()
		return resp(c, cret(true, "challenge", challenge), fiber.StatusOK)
	})
}

func SetupLogin(s *Server, group fiber.Router) {
	group.Post("/login", func(c *fiber.Ctx) error {
		var b struct {
			PubKey    string `json:"public_key"`
			Challenge string `json:"challenge"`
			Signature string `json:"signature"`
		}

		if err := c.BodyParser(&b); err != nil {
			return resp(c, cret(false, "Invalid body", nil), fiber.StatusBadRequest)
		}

		s.ChallengeMu.Lock()
		expiry, exists := s.Challenges[b.Challenge]
		if exists {
			delete(s.Challenges, b.Challenge)
		}
		s.ChallengeMu.Unlock()
		if !exists {
			return resp(c, cret(false, "Invalid challenge", nil), fiber.StatusBadRequest)
		}
		if time.Now().After(expiry) {
			return resp(c, cret(false, "Challenge expired", nil), fiber.StatusBadRequest)
		}

		var user User
		if err := s.DB.Where("public_key = ?", b.PubKey).First(&user).Error; err != nil {
			return resp(c, cret(false, "User not found", nil), fiber.StatusBadRequest)
		}

		// Verify that the user's private key was used to sign the challenge
		valid, err := helper.VerifySignature(user.PublicKey, b.Challenge, b.Signature)
		if err != nil || !valid {
			return resp(c, cret(false, "Authentication failed", nil), fiber.StatusBadRequest)
		}

		claims := jwt.MapClaims{
			"username":   user.Username,
			"public_key": user.PublicKey,
			"exp":        time.Now().Add(time.Hour * 72).Unix(),
		}
		token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)

		t, err := token.SignedString([]byte(s.Pass))
		if err != nil {
			return resp(c, cret(false, fmt.Sprintf("Failed to generate JWT, %v", err), nil), fiber.StatusInternalServerError)
		}

		return resp(c, cret(true, "token", t), fiber.StatusOK)
	})
}

func SetupUpdateProfile(s *Server, group fiber.Router) {
	group.Post("/user", func(c *fiber.Ctx) error {
		userToken := c.Locals("user").(*jwt.Token)
		claims := userToken.Claims.(jwt.MapClaims)
		pubKey := claims["public_key"].(string)

		var b struct {
			Username string `json:"username"`
		}

		if err := c.BodyParser(&b); err != nil {
			return resp(c, cret(false, "Invalid body", nil), fiber.StatusBadRequest)
		}

		if b.Username == "" {
			return resp(c, cret(false, "Username is required", nil), fiber.StatusBadRequest)
		}

		if err := s.DB.Model(&User{}).Where("public_key = ?", pubKey).Update("username", b.Username).Error; err != nil {
			return resp(c, cret(false, "Failed to update profile", nil), fiber.StatusInternalServerError)
		}

		return resp(c, cret(true, "Profile updated", nil), fiber.StatusOK)
	})
}

func SetupStaticFrontEnd(s *Server) {
	s.App.Static("/", "./frontend")
}

// SetupNetworkInfo provides endpoint for getting current network SSID
func SetupNetworkInfo(group fiber.Router) {
	group.Get("/network/ssid", func(c *fiber.Ctx) error {
		netInfo := GetCurrentSSID()
		return resp(c, cret(true, "network", netInfo), fiber.StatusOK)
	})
}

func SetupWebSocketEndPoint(s *Server, group fiber.Router) {
	group.Use("/ws", helper.WebSocketJWTGate)
	group.Get("/ws", websocket.New(func(conn *websocket.Conn) {
		claims, ok := conn.Locals("claims").(jwt.MapClaims)
		if !ok {
			return
		}

		pubkey := claims["public_key"].(string)
		expUnix := int64(claims["exp"].(float64))
		expTime := time.Unix(expUnix, 0)

		s.MUserMu.Lock()
		for _, managedUser := range s.MUser {
			if managedUser.User.PublicKey == pubkey {
				managedUser.Conn.Close()
				managedUser.Conn = conn

				s.CachedUserMu.Lock()
				DelCachedUser(s, managedUser.User.ID)
				s.CachedUserMu.Unlock()
				break
			}
		}
		s.MUserMu.Unlock()

		var user User
		if err := s.DB.Where("public_key = ?", pubkey).First(&user).Error; err != nil {
			return
		}

		s.MUserMu.Lock()

		muser := &ManagedUser{
			MinUser:   MinimalUser{user.Username, user.PublicKey}, // to send to network
			User:      user,
			Conn:      conn,
			JWTExpiry: expTime,
		}
		s.MUser[conn] = muser

		s.MUserMu.Unlock()

		if len(s.CachedUser) <= 0 {
			CacheDiscoverableUser(s)
		} else {
			AddCachedUser(s, muser)
		}

		defer func() {
			s.CachedUserMu.Lock()
			DelCachedUser(s, s.MUser[conn].User.ID)
			s.CachedUserMu.Unlock()

			conn.Close()

			s.MUserMu.Lock()
			delete(s.MUser, conn)
			s.MUserMu.Unlock()

			log.Println("WS disconnected user:", claims["username"])
		}()

		HandleWS(s, muser)
	}))
}

func (s *Server) SetupAllEndPoint() {
	api_pub := s.App.Group("/api/v1/")
	protected := api_pub.Group("/protected", jwtware.New(jwtware.Config{
		SigningKey:  jwtware.SigningKey{Key: []byte(s.Pass)},
		TokenLookup: "header:Authorization,query:token",
		AuthScheme:  "Bearer",
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

	// GET: /api/v1/network/ssid
	// Get current network SSID (public endpoint)
	SetupNetworkInfo(api_pub)

	// POST: /api/v1/protected/user
	// Update user profile (username)
	SetupUpdateProfile(s, protected)

	// GET: /api/v1/protected/ws
	// to upgrade the connection to websocket for later
	// use (listing all the near ppl, conn to webrtc)
	SetupWebSocketEndPoint(s, protected)
}
