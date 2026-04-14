import { DataTypes } from "sequelize"
import { sequelize } from "../config/db.js"

export const UserProject = sequelize.define("UserProject", {
    telegram_id: {
        type: DataTypes.STRING
    },
    project_id: {
        type: DataTypes.STRING
    },
    project_name: {
        type: DataTypes.STRING
    },
    container_id: {
        type: DataTypes.STRING
    },
    status: {
        type: DataTypes.STRING
    }
})