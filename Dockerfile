# Use the official Nginx Alpine image for a lightweight static server
FROM nginx:alpine

# Copy all repository files to the Nginx serving directory
COPY . /usr/share/nginx/html/

# Expose port 80 to the outside
EXPOSE 80

# Nginx starts automatically
