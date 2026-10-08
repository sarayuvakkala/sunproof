FROM public.ecr.aws/lambda/python:3.12-arm64

COPY requirements.txt ${LAMBDA_TASK_ROOT}/
RUN pip install --no-cache-dir -r ${LAMBDA_TASK_ROOT}/requirements.txt

COPY engine/ ${LAMBDA_TASK_ROOT}/engine/
COPY backend/functions/api/ ${LAMBDA_TASK_ROOT}/api/
COPY accuracy/ ${LAMBDA_TASK_ROOT}/accuracy/

CMD ["api.handler.handler"]
