sudo apt update && sudo apt install ffmpeg


mkdir ../../models/whisper
cd ../../models/whisper

pip install git+https://github.com/openai/whisper.git 

curl -s https://packagecloud.io/install/repositories/github/git-lfs/script.deb.sh | sudo bash
sudo apt-get install git-lfs

# upgrade:
# pip install --upgrade --no-deps --force-reinstall git+https://github.com/openai/whisper.git

#git lfs install
#git clone https://huggingface.co/openai/whisper-small.en
#git clone https://huggingface.co/openai/whisper-medium.en
