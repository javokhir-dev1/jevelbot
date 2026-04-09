import { DataTypes } from "sequelize"
import { sequelize } from "../config/db.js"

export const User = sequelize.define("User", {
    telegram_id: {
        type: DataTypes.STRING
    },
    username: {
        type: DataTypes.STRING,
    },
    full_name: {
        type: DataTypes.STRING
    }
})