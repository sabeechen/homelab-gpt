FROM python:3
WORKDIR /app
COPY . /app
RUN pip3 install -r /app/chat/requirements.txt
WORKDIR /
CMD ["python", "-m", "app.chat"]