from django.contrib.auth.hashers import Argon2PasswordHasher

class MinArgon2PasswordHasher(Argon2PasswordHasher):
    parallelism = 1
    time_cost = 2
    memory_cost = 19456