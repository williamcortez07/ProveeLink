import { ZodError } from "zod";

export const validateRequest = (schema) => (req, res, next) => {
  try {
    const validated = schema.parse({
      body: req.body,
      query: req.query,
      params: req.params,
    });
    req.body = validated.body;

    if (validated.query !== undefined) {
      Object.defineProperty(req, "query", {
        value: validated.query,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    if (validated.params !== undefined) {
      Object.defineProperty(req, "params", {
        value: validated.params,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    }

    next();
  } catch (error) {
    if (error instanceof ZodError) {
      const formattedErrors = error.errors.reduce((acc, e) => {
        const field = e.path.length ? e.path.join(".") : "body";
        if (!acc[field]) acc[field] = e.message;
        return acc;
      }, {});

      return res.status(400).json({
        success: false,
        message: "Error de validación en la petición",
        errors: formattedErrors,
      });
    }
    next(error);
  }
};
