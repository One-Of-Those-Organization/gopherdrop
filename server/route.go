package server

import (
	"fmt"
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
	group.Post("/register", func (c *fiber.Ctx) error {
		var b struct {
			Username string `json:"username"`
		};

        err:= c.BodyParser(&b)
        if err != nil {
            return resp(c, cret(false, fmt.Sprintf("%v", err), nil))
        }

		test := len(b.Username) <= 0
		if test { return resp(c, cret(false, "UserName is empty", nil)) }

		password, err := helper.CreateRandomString(32)
		if err != nil {
            return resp(c, cret(false, fmt.Sprintf("%v", err), nil))
		}
		passwordb := helper.WrapBase64(password)
		password_final, err := helper.HashPassword(passwordb)
		if err != nil {
            return resp(c, cret(false, fmt.Sprintf("%v", err), nil))
		}

		newUser := User{
			Username: b.Username,
			Password: password_final,
			CreatedAt: time.Now(),
		}
		result := s.DB.Create(&newUser)
		if result.Error != nil {
            return resp(c, cret(false, fmt.Sprintf("Failed to write to db, %v", result.Error), nil))
		}

		return resp(c, cret(true, "user", newUser))
	})
}

func SetupLogin(_ *Server, group fiber.Router) {
	group.Post("/login", func (c *fiber.Ctx) error {
		return c.SendString("WIP")
	})
}
