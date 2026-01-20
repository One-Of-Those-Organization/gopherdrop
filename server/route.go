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

func resp(c *fiber.Ctx, ret Ret) error {
	return c.Status(fiber.StatusBadRequest).JSON(ret)
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
			return resp(c, cret(false, "Invalid body", nil))
		}

		if b.Username == "" || b.PublicKey == "" {
			return resp(c, cret(false, "Username and PublicKey are required", nil))
		}

		newUser := User{
			Username:  b.Username,
			PublicKey: b.PublicKey,
			CreatedAt: time.Now(),
		}

		if err := s.DB.Create(&newUser).Error; err != nil {
			return resp(c, cret(false, "Username might already exist", nil))
		}

		return resp(c, cret(true, "user", newUser))
	})
}

func SetupLogin(s *Server, group fiber.Router) {
	// 1. Client asks for a challenge
	group.Get("/challenge", func(c *fiber.Ctx) error {
		challenge, _ := helper.GenerateChallenge()
		return resp(c, cret(true, "challenge", challenge))
	})

	// 2. Client sends signed challenge
	group.Post("/login", func(c *fiber.Ctx) error {
		var b struct {
			Username  string `json:"username"`
			Challenge string `json:"challenge"`
			Signature string `json:"signature"`
		}

		if err := c.BodyParser(&b); err != nil {
			return resp(c, cret(false, "Invalid body", nil))
		}

		var user User
		if err := s.DB.Where("username = ?", b.Username).First(&user).Error; err != nil {
			return resp(c, cret(false, "User not found", nil))
		}

		// Verify that the user's private key was used to sign the challenge
		valid, err := helper.VerifySignature(user.PublicKey, b.Challenge, b.Signature)
		if err != nil || !valid {
			return resp(c, cret(false, "Authentication failed", nil))
		}

		return resp(c, cret(true, "Login success", user))
	})
}
