"""Publishing to the stream. Topic names are '<service>.<past-tense-verb>'."""


def publish(bus, topic, payload, correlation_id):
    assert "." in topic, "topic must be <service>.<event>"
    return bus.append(topic, {"payload": payload, "correlation_id": correlation_id})
