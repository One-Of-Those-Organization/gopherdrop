package server

import (
	"gorm.io/driver/sqlite"
	"gorm.io/gorm"
	"log"
	"time"
)

type User struct {
	ID             int       `gorm:"primaryKey" json:"id"`
	Username       string    `gorm:"column:username" json:"username"`
	PublicKey      string    `gorm:"column:public_key" json:"public_key"`
	IsDiscoverable bool      `gorm:"default:true;column:discoverable" json:"is_discoverable"`
	CreatedAt      time.Time `gorm:"column:user_created_at;type:datetime"`
}

func OpenDB(dbFile string) (*gorm.DB, error) {
	db, err := gorm.Open(sqlite.Open(dbFile), &gorm.Config{})
	if err != nil {
		return nil, err
	}
	return db, nil
}

func MigrateDB(db *gorm.DB) error {
	err := db.AutoMigrate(&User{})
	if err != nil {
		log.Fatal("failed to migrate database:", err)
		return err
	}
	return nil
}
