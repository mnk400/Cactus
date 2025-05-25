# Cactus
```
    ,*-.
    |  |
,.  |  |
| |_|  | ,.
`---.  |_| |
    |  .--`
    |  |
    |  | 

```

Extemely minimal randomized order media reviewer

## Usage

1. Install dependencies:
   ```
   npm install
   ```

2. Start the server with a directory path:
   ```
   npm start -- -d /path/to/your/media/directory -p 3000
   ```
   Or directly using node:
   ```
   node server.js -d /path/to/your/media/directory -p 3000
   ```

3. Open your browser and go to http://localhost:3000

4. The application will automatically load and display media files from the specified directory

5. Navigate through the media using:
   - Up/Down arrow keys
   - Navigation buttons on the bottom

## Docker
Can also be deployed through docker using the included dockerfile, something like: 

```
docker build -t cactus-media-server .

docker run -p 3000:3000 -v /path/to/your/media/directory:/media cactus-media-server
```