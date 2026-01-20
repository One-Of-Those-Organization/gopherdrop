package server

import (
    "log"
	"time"
    "gorm.io/driver/sqlite"
    "gorm.io/gorm"
)

type User struct {
	ID			 int		`gorm:"primaryKey" json:"id"`
	Username	 string		`gorm:"column:username" json:"username"`
	Password	 string		`gorm:"column:password" json:"-"`
	CreatedAt	 time.Time	`gorm:"column:user_created_at;type:datetime"`
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
