package server

import (
	"time"
	"github.com/gofiber/fiber/v2"
	"gopherdrop/helper"
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
	return Ret{ Success, Message, Counter - 1, Data }
}

func resp(c *fiber.Ctx, ret Ret, code int) error {
    return c.Status(code).JSON(ret)
}

func SetupRoot(s *Server) {
	s.App.Get("/", func (c *fiber.Ctx) error {
		return c.SendString("Server is online")
	})

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
			Username:  b.Username,
			PublicKey: b.PublicKey,
			CreatedAt: time.Now(),
		}

		if err := s.DB.Create(&newUser).Error; err != nil {
			return resp(c, cret(false, "Username might already exist", nil), fiber.StatusBadRequest)
		}

		return resp(c, cret(true, "user", newUser), fiber.StatusOK)
	})
}

func SetupLogin(s *Server, group fiber.Router) {
	if s.Challenges == nil { s.Challenges = make(map[string]time.Time) }
	group.Get("/challenge", func(c *fiber.Ctx) error {
		challenge, _ := helper.GenerateChallenge()
		s.ChallengeMu.Lock()
		s.Challenges[challenge] = time.Now().Add(2 * time.Minute)
		s.ChallengeMu.Unlock()
		return resp(c, cret(true, "challenge", challenge), fiber.StatusOK)
	})

	group.Post("/login", func(c *fiber.Ctx) error {
		var b struct {
			Username  string `json:"username"`
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
		if err := s.DB.Where("username = ?", b.Username).First(&user).Error; err != nil {
			return resp(c, cret(false, "User not found", nil), fiber.StatusBadRequest)
		}

		// Verify that the user's private key was used to sign the challenge
		valid, err := helper.VerifySignature(user.PublicKey, b.Challenge, b.Signature)
		if err != nil || !valid {
			return resp(c, cret(false, "Authentication failed", nil), fiber.StatusBadRequest)
		}

		return resp(c, cret(true, "Login success", user), fiber.StatusOK)
	})
}
