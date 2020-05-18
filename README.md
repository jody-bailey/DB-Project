# CSC-411 Course Project

This project is for CSC-411 Databases at the University of Southern Mississippi.

### How to run the application

1. In a terminal/CMD prompt, navigate to where you would like to save the project.
2. Enter command `git clone https://github.com/jody-bailey/DB-Project.git`
   Optional: You may also rename the project locally by doing `git clone https://github.com/jody-bailey/DB-Project.git [NAME GOES HERE]`
3. Now, `cd DB-Project`
4. Then, `npm install` to install the necessary node module dependencies.
5. Open the project in your favorite text editor (VS Code recommended).
6. Create a .env file at the top level.
   What to include:
   PORT=3000  
   MYSQL_USER=YOUR_MYSQL_USERNAME  
   MYSQL_PASSWORD=YOUR_MYSQL_PASSWORD  
   MYSQL_DATABASE=db_project  
5. Finally, run `npm run server.js`

When the application starts up, navigate to `http://localhost:3000` in your browser. Click on "Seed Database" in the top right corner. Wait while the database is seeded with the data. A green notification will appear when it is complete.

Now, click on "Start Here" to see the query options. Select each one to see the results of the queries.

