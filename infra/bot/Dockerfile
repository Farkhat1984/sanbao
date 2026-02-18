FROM python:3.12-slim

WORKDIR /app

# Install system deps + Docker CLI (static binary)
RUN apt-get update &&     apt-get install -y --no-install-recommends curl rsync openssh-client &&     rm -rf /var/lib/apt/lists/* &&     curl -fsSL https://download.docker.com/linux/static/stable/x86_64/docker-27.5.1.tgz |     tar xz --strip-components=1 -C /usr/local/bin docker/docker &&     chmod +x /usr/local/bin/docker

# Install Docker Compose plugin
RUN mkdir -p /usr/local/lib/docker/cli-plugins &&     curl -fsSL https://github.com/docker/compose/releases/download/v2.33.1/docker-compose-linux-x86_64     -o /usr/local/lib/docker/cli-plugins/docker-compose &&     chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY monitor_bot.py .

RUN mkdir -p /data

CMD ["python", "monitor_bot.py"]
