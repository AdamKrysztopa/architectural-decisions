"""Configuration comes from the environment, declared per service."""

import os


def required(name):
    return os.environ[name]


def optional(name, default):
    return os.environ.get(name, default)
