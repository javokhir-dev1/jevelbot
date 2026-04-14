import { DataTypes } from "sequelize"
import { sequelize } from "../config/db.js"

export const User = sequelize.define("User", {
    telegram_id: {
        type: DataTypes.STRING
    },
    project_id: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.STRING
    }
})