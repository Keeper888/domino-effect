FROM nginx:alpine

# Copy static files to nginx html directory
COPY . /usr/share/nginx/html

# Remove unnecessary files from the image
RUN rm -rf /usr/share/nginx/html/.git \
    /usr/share/nginx/html/Dockerfile \
    /usr/share/nginx/html/backend \
    /usr/share/nginx/html/supabase \
    /usr/share/nginx/html/*.py \
    /usr/share/nginx/html/*.exe \
    /usr/share/nginx/html/*.zip

# Expose port 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
