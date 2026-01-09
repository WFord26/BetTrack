export default {
  datasources: {
    db: {
      url: process.env.DATABASE_URL || 'postgresql://sports_user:sports_password_change_in_production@localhost:5432/sports_betting_dashboard'
    }
  }
}
