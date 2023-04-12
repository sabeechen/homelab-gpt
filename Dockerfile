FROM python:3
WORKDIR /app
COPY . /app
RUN pip3 install -r /app/server/requirements.txt
WORKDIR /
CMD ["python", "-m", "app.server"]