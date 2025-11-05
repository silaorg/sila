import { Vertex } from "@sila/core";

export default class VertexViewer {

  vertices: Vertex[] = $state([]);
  activeVertexIndex: number = $state(0);

  activeVertex: Vertex | undefined = $derived(this.vertices[this.activeVertexIndex]);

  openVertex(vertex: Vertex) {
    this.vertices = [vertex];
  }

  openVertices(vertices: Vertex[], activeVertexIndex: number = 0) {
    if (vertices.length === 0) {
      throw new Error("Cannot open an empty list of vertices");
    }

    this.vertices = vertices;
    this.activeVertexIndex = activeVertexIndex;
  }

  close() {
    this.vertices = [];
    this.activeVertexIndex = 0;
  }

}