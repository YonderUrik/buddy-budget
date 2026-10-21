package io.buddybudget.core.data

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.JsonDecoder
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull

/**
 * Money in the API is a JSON number in the computed views and a numeric string in some row endpoints
 * (api/README.md §6): this serializer accepts both. Same role as `FlexibleDouble` on iOS.
 */
object FlexibleDoubleSerializer : KSerializer<Double> {
    override val descriptor = PrimitiveSerialDescriptor("FlexibleDouble", PrimitiveKind.DOUBLE)

    override fun deserialize(decoder: Decoder): Double {
        val json = decoder as? JsonDecoder ?: return decoder.decodeDouble()
        val element = json.decodeJsonElement()
        val primitive = element as? JsonPrimitive ?: throw IllegalArgumentException("Expected a number or a numeric string")
        return primitive.doubleOrNull ?: primitive.content.trim().toDoubleOrNull()
            ?: throw IllegalArgumentException("Expected a number or a numeric string")
    }

    override fun serialize(encoder: Encoder, value: Double) = encoder.encodeDouble(value)
}

/** An amount decoded from a JSON number or a numeric string (`Double?` fields stay nullable). */
typealias FlexDouble = @Serializable(with = FlexibleDoubleSerializer::class) Double
